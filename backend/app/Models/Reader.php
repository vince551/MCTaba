<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Reader extends Model
{
    protected $fillable = ['library_id', 'name', 'email', 'member_number', 'type', 'status'];

    public function library(): BelongsTo { return $this->belongsTo(Library::class); }
    public function loans(): HasMany { return $this->hasMany(Loan::class); }
}