<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Library;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ReaderController extends Controller
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
        $readers = $library->readers()
            ->when($request->string('search')->isNotEmpty(), function ($query) use ($request): void {
                $term = '%'.$request->string('search')->trim().'%';
                $query->where(fn ($q) => $q->where('name', 'ilike', $term)->orWhere('member_number', 'ilike', $term)->orWhere('email', 'ilike', $term));
            })->orderBy('name')->paginate(25);
        return response()->json($readers);
    }

    public function store(Request $request, Library $library): JsonResponse
    {
        $this->ensureStaff($request, $library);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:180'],
            'email' => ['nullable', 'email', 'max:254'],
            'member_number' => ['nullable', 'string', 'max:80', Rule::unique('readers')->where('library_id', $library->id)],
            'type' => ['required', 'in:student,staff,community,teacher,other'],
        ]);
        $data['member_number'] = $data['member_number'] ?? strtoupper('MBR-'.Str::random(10));
        $data['status'] = 'active';
        $reader = $library->readers()->create($data);
        return response()->json(['data' => $reader], 201);
    }
}