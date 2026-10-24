<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('books', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('library_id')->constrained()->cascadeOnDelete();
            $table->string('title', 240);
            $table->string('author', 180);
            $table->string('isbn', 20)->nullable();
            $table->string('category', 100)->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
            $table->index(['library_id', 'title']);
            $table->index(['library_id', 'author']);
            $table->unique(['library_id', 'isbn']);
        });

        Schema::create('book_copies', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('library_id')->constrained()->cascadeOnDelete();
            $table->foreignId('book_id')->constrained()->cascadeOnDelete();
            $table->string('barcode', 80);
            $table->string('status', 24)->default('available');
            $table->timestamps();
            $table->unique(['library_id', 'barcode']);
            $table->index(['library_id', 'book_id', 'status']);
        });

        Schema::create('readers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('library_id')->constrained()->cascadeOnDelete();
            $table->string('name', 180);
            $table->string('email', 254)->nullable();
            $table->string('member_number', 80);
            $table->string('type', 40)->default('community');
            $table->string('status', 24)->default('active');
            $table->timestamps();
            $table->unique(['library_id', 'member_number']);
            $table->index(['library_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('readers');
        Schema::dropIfExists('book_copies');
        Schema::dropIfExists('books');
    }
};