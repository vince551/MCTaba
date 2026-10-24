<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Membership extends Model
{
    protected $fillable = ['library_id', 'user_id', 'role', 'status'];

    public function library(): BelongsTo { return $this->belongsTo(Library::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}