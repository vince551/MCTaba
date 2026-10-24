<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Library extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'type', 'location', 'created_by'];

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'memberships')
            ->withPivot(['role', 'status'])
            ->withTimestamps();
    }

    public function memberships(): HasMany { return $this->hasMany(Membership::class); }
    public function books(): HasMany { return $this->hasMany(Book::class); }
    public function readers(): HasMany { return $this->hasMany(Reader::class); }
    public function loans(): HasMany { return $this->hasMany(Loan::class); }
}