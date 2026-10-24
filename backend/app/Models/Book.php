<?php

namespace App\\Models;

use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;
use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\Relations\\HasMany;

class Book extends Model
{
    use HasFactory;

    protected $fillable = ['library_id', 'title', 'author', 'isbn', 'category', 'description'];

    public function copies(): HasMany { return $this->hasMany(BookCopy::class); }
}