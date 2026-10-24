<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    protected $fillable = ['library_id', 'user_id', 'event', 'metadata', 'ip_address'];

    protected function casts(): array
    {
        return ['metadata' => 'array'];
    }

    public function library(): BelongsTo { return $this->belongsTo(Library::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}