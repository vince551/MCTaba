<?php

namespace Tests\Feature;

use App\Models\Library;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_create_a_library_and_become_its_owner(): void
    {
        $user = User::create([
            'name' => 'Library Owner',
            'email' => 'owner@example.test',
            'password' => 'test-password-123',
        ]);

        Sanctum::actingAs($user);

        $this->postJson('/api/libraries', [
            'name' => 'Community Library',
            'type' => 'community',
            'location' => 'Nairobi',
        ])->assertCreated()
          ->assertJsonPath('data.name', 'Community Library')
          ->assertJsonPath('role', 'owner');

        $this->assertDatabaseHas('libraries', [
            'name' => 'Community Library',
            'created_by' => $user->id,
        ]);
        $this->assertDatabaseHas('memberships', [
            'user_id' => $user->id,
            'role' => 'owner',
            'status' => 'active',
        ]);
    }

    public function test_user_cannot_read_another_tenants_books(): void
    {
        $owner = User::create([
            'name' => 'Tenant Owner',
            'email' => 'owner2@example.test',
            'password' => 'test-password-123',
        ]);
        $outsider = User::create([
            'name' => 'Outside User',
            'email' => 'outsider@example.test',
            'password' => 'test-password-123',
        ]);
        $library = Library::create([
            'name' => 'Private Library',
            'type' => 'private',
            'created_by' => $owner->id,
        ]);
        $library->members()->attach($owner->id, ['role' => 'owner', 'status' => 'active']);

        Sanctum::actingAs($outsider);

        $this->getJson('/api/libraries/'.$library->id.'/books')->assertForbidden();
    }

    public function test_library_routes_require_authentication(): void
    {
        $this->getJson('/api/libraries')->assertUnauthorized();
    }
}