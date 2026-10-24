<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Book;
use App\Models\Library;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class BookController extends Controller
{
    private function ensureMember(Request $request, Library $library): void
    {
        abort_unless($library->members()->whereKey($request->user()->id)
            ->wherePivot('status', 'active')->exists(), 403, 'No access to this library.');
    }

    private function ensureCanManage(Request $request, Library $library): void
    {
        $membership = $library->members()->whereKey($request->user()->id)->first();
        abort_unless($membership && $membership->pivot->status === 'active', 403, 'No access to this library.');
        abort_unless(in_array($membership->pivot->role, ['owner', 'admin', 'librarian'], true), 403, 'Insufficient role.');
    }

    public function index(Request $request, Library $library): JsonResponse
    {
        $this->ensureMember($request, $library);
        $books = $library->books()->withCount(['copies as total_copies'])
            ->withCount(['copies as available_copies' => fn ($q) => $q->where('status', 'available')])
            ->when($request->string('search')->isNotEmpty(), function ($query) use ($request): void {
                $term = '%'.$request->string('search')->trim().'%';
                $query->where(fn ($q) => $q->where('title', 'ilike', $term)->orWhere('author', 'ilike', $term)->orWhere('isbn', 'ilike', $term));
            })->orderBy('title')->paginate(25);

        return response()->json($books);
    }

    public function store(Request $request, Library $library): JsonResponse
    {
        $this->ensureCanManage($request, $library);
        $data = $request->validate([
            'title' => ['required', 'string', 'max:240'],
            'author' => ['required', 'string', 'max:180'],
            'isbn' => ['nullable', 'string', 'max:20', Rule::unique('books')->where('library_id', $library->id)],
            'category' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:10000'],
            'copies' => ['required', 'integer', 'min:1', 'max:500'],
        ]);

        $book = DB::transaction(function () use ($library, $data): Book {
            $count = $data['copies'];
            unset($data['copies']);
            $book = $library->books()->create($data);
            for ($i = 0; $i < $count; $i++) {
                $book->copies()->create([
                    'library_id' => $library->id,
                    'barcode' => strtoupper('MCT-'.$library->id.'-'.$book->id.'-'.bin2hex(random_bytes(4))),
                    'status' => 'available',
                ]);
            }
            AuditLog::create([
                'library_id' => $library->id,
                'user_id' => auth()->id(),
                'event' => 'book.created',
                'metadata' => ['book_id' => $book->id, 'copies_created' => $count],
                'ip_address' => request()->ip(),
            ]);
            return $book->loadCount('copies');
        });

        return response()->json(['data' => $book], 201);
    }

    public function show(Request $request, Library $library, Book $book): JsonResponse
    {
        $this->ensureMember($request, $library);
        abort_unless($book->library_id === $library->id, 404);
        return response()->json(['data' => $book->loadCount('copies')]);
    }

    public function update(Request $request, Library $library, Book $book): JsonResponse
    {
        $this->ensureCanManage($request, $library);
        abort_unless($book->library_id === $library->id, 404);
        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:240'],
            'author' => ['sometimes', 'required', 'string', 'max:180'],
            'isbn' => ['nullable', 'string', 'max:20', Rule::unique('books')->where('library_id', $library->id)->ignore($book->id)],
            'category' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:10000'],
        ]);
        $book->update($data);
        return response()->json(['data' => $book->fresh()]);
    }

    public function destroy(Request $request, Library $library, Book $book): JsonResponse
    {
        $membership = $library->members()->whereKey($request->user()->id)->first();
        abort_unless($membership && $membership->pivot->status === 'active', 403, 'No access to this library.');
        abort_unless(in_array($membership->pivot->role, ['owner', 'admin'], true), 403, 'Only owners and admins can delete titles.');
        abort_unless($book->library_id === $library->id, 404);
        abort_if($book->copies()->where('status', 'borrowed')->exists(), 409, 'Return borrowed copies before deleting this title.');
        AuditLog::create([
            'library_id' => $library->id,
            'user_id' => $request->user()->id,
            'event' => 'book.deleted',
            'metadata' => ['book_id' => $book->id],
            'ip_address' => $request->ip(),
        ]);
        $book->delete();
        return response()->json(['message' => 'Book deleted.']);
    }
}