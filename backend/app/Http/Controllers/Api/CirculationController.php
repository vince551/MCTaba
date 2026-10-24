<?php

namespace App\\Http\\Controllers\\Api;

use App\\Http\\Controllers\\Controller;
use App\\Models\\BookCopy;
use App\\Models\\Library;
use App\\Models\\Loan;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Carbon;
use Illuminate\\Support\\Facades\\DB;

class CirculationController extends Controller
{
    private function ensureStaff(Request $request, Library $library): void
    {
        $membership = $library->members()->whereKey($request->user()->id)->first();
        abort_unless($membership && $membership->pivot->status === 'active', 403, 'No access to this library.');
        abort_unless(in_array($membership->pivot->role, ['owner', 'admin', 'librarian'], true), 403, 'Insufficient role.');
    }

    public function index(Request $request, Library $library): JsonResponse
    {
        $this->ensureStaff($request, $library);
        return response()->json($library->loans()->with(['reader', 'copy.book'])
            ->latest('checked_out_at')->paginate(25));
    }

    public function checkout(Request $request, Library $library): JsonResponse
    {
        $this->ensureStaff($request, $library);
        $data = $request->validate([
            'copy_id' => ['required', 'integer', 'exists:book_copies,id'],
            'reader_id' => ['required', 'integer', 'exists:readers,id'],
            'due_at' => ['required', 'date', 'after:now'],
        ]);

        $loan = DB::transaction(function () use ($request, $library, $data): Loan {
            $copy = BookCopy::where('library_id', $library->id)->whereKey($data['copy_id'])->lockForUpdate()->firstOrFail();
            $reader = $library->readers()->whereKey($data['reader_id'])->where('status', 'active')->firstOrFail();
            abort_unless($copy->status === 'available', 409, 'This copy is not available.');
            $copy->update(['status' => 'borrowed']);
            return $library->loans()->create([
                'copy_id' => $copy->id,
                'reader_id' => $reader->id,
                'checked_out_by' => $request->user()->id,
                'checked_out_at' => now(),
                'due_at' => Carbon::parse($data['due_at']),
                'status' => 'active',
            ])->load(['reader', 'copy.book']);
        });

        return response()->json(['data' => $loan], 201);
    }

    public function returnBook(Request $request, Library $library, Loan $loan): JsonResponse
    {
        $this->ensureStaff($request, $library);
        abort_unless($loan->library_id === $library->id, 404);

        $loan = DB::transaction(function () use ($loan): Loan {
            $lockedLoan = Loan::whereKey($loan->id)->lockForUpdate()->firstOrFail();
            abort_unless($lockedLoan->status === 'active', 409, 'This loan has already been returned.');
            $copy = BookCopy::whereKey($lockedLoan->copy_id)->lockForUpdate()->firstOrFail();
            $lockedLoan->update(['returned_at' => now(), 'status' => 'returned']);
            $copy->update(['status' => 'available']);
            return $lockedLoan->load(['reader', 'copy.book']);
        });

        return response()->json(['data' => $loan]);
    }
}