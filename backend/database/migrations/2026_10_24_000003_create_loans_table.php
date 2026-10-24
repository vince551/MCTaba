<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('loans', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('library_id')->constrained()->cascadeOnDelete();
            $table->foreignId('copy_id')->constrained('book_copies')->restrictOnDelete();
            $table->foreignId('reader_id')->constrained()->restrictOnDelete();
            $table->foreignId('checked_out_by')->constrained('users')->restrictOnDelete();
            $table->timestampTz('checked_out_at');
            $table->timestampTz('due_at');
            $table->timestampTz('returned_at')->nullable();
            $table->string('status', 24)->default('active');
            $table->timestamps();
            $table->index(['library_id', 'status', 'due_at']);
            $table->index(['library_id', 'reader_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loans');
    }
};