<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_and_use_the_returned_api_token(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Test Librarian',
            'email' => 'librarian@example.test',
            'password' => 'secure-test-password',
            'password_confirmation' => 'secure-test-password',
        ])->assertCreated()
          ->assertJsonStructure(['user' => ['id', 'name', 'email'], 'token']);

        $token = $response->json('token');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'librarian@example.test');
    }

    public function test_registration_rejects_short_passwords(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Test Librarian',
            'email' => 'short-password@example.test',
            'password' => 'short',
            'password_confirmation' => 'short',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['password']);
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        $this->postJson('/api/auth/login', [
            'email' => 'missing@example.test',
            'password' => 'wrong-password',
        ])->assertUnprocessable();
    }
}