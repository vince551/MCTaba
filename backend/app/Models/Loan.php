<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Loan extends Model
{
    protected $fillable = ['library_id', 'copy_id', 'reader_id', 'checked_out_by', 'checked_out_at', 'due_at', 'returned_at', 'status'];

    protected function casts(): array
    {
        return ['checked_out_at' => 'datetime', 'due_at' => 'datetime', 'returned_at' => 'datetime'];
    }

    public function copy(): BelongsTo { return $this->belongsTo(BookCopy::class, 'copy_id'); }
    public function reader(): BelongsTo { return $this->belongsTo(Reader::class); }
}