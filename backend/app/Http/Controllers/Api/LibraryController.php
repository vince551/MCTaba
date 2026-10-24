<?php

namespace App\\Http\\Controllers\\Api;

use App\\Http\\Controllers\\Controller;
use App\\Models\\Library;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;

class LibraryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->libraries()->wherePivot('status', 'active')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'type' => ['required', 'in:school,university,public,community,church,private,other'],
            'location' => ['nullable', 'string', 'max:160'],
        ]);

        $library = DB::transaction(function () use ($request, $data): Library {
            $library = Library::create([...$data, 'created_by' => $request->user()->id]);
            $library->members()->attach($request->user()->id, ['role' => 'owner', 'status' => 'active']);
            return $library;
        });

        return response()->json(['data' => $library, 'role' => 'owner'], 201);
    }

    public function show(Request $request, Library $library): JsonResponse
    {
        $this->authorizeMembership($request, $library);
        return response()->json(['data' => $library]);
    }

    public function authorizeMembership(Request $request, Library $library): void
    {
        abort_unless(
            $library->members()->whereKey($request->user()->id)
                ->wherePivot('status', 'active')->exists(),
            403,
            'You do not have active access to this library.'
        );
    }
}