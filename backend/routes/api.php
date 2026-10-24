<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BookController;
use App\Http\Controllers\Api\CirculationController;
use App\Http\Controllers\Api\LibraryController;
use App\Http\Controllers\Api\ReaderController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json([
    'status' => 'ok',
    'service' => 'mctaba-api',
    'version' => '1.0.0',
]));

Route::prefix('auth')->group(function (): void {
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/libraries', [LibraryController::class, 'index']);
    Route::post('/libraries', [LibraryController::class, 'store']);
    Route::get('/libraries/{library}', [LibraryController::class, 'show']);

    Route::prefix('libraries/{library}')->group(function (): void {
        Route::get('/books', [BookController::class, 'index']);
        Route::post('/books', [BookController::class, 'store']);
        Route::get('/books/{book}', [BookController::class, 'show']);
        Route::patch('/books/{book}', [BookController::class, 'update']);
        Route::delete('/books/{book}', [BookController::class, 'destroy']);

        Route::get('/readers', [ReaderController::class, 'index']);
        Route::post('/readers', [ReaderController::class, 'store']);

        Route::get('/loans', [CirculationController::class, 'index']);
        Route::post('/loans/checkout', [CirculationController::class, 'checkout']);
        Route::post('/loans/{loan}/return', [CirculationController::class, 'returnBook']);
    });
});