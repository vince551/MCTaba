<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BookCopy;
use App\Models\Library;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CopyController extends Controller
{
    public function index(Request $request, Library $library): JsonResponse
    {
        abort_unless($library->members()->whereKey($request->user()->id)
            ->wherePivot('status', 'active')->exists(), 403, 'No access to this library.');

        $copies = $library->books()
            ->with(['copies' => fn ($query) => $query->orderBy('id')])
            ->get()
            ->flatMap(fn ($book) => $book->copies->map(fn (BookCopy $copy) => [
                'id' => $copy->id,
                'book_id' => $book->id,
                'book_title' => $book->title,
                'barcode' => $copy->barcode,
                'status' => $copy->status,
            ]));

        return response()->json(['data' => $copies->values()]);
    }
}