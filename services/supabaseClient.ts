import { createClient } from '@supabase/supabase-js';

// Using the provided credentials directly to ensure connection
const SUPABASE_URL = 'https://fuezuatlryjvqtwzxabb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1ZXp1YXRscnlqdnF0d3p4YWJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNjgzMzQsImV4cCI6MjA3OTg0NDMzNH0._SxQK9Flc4564yVlMyzcIjjNcrC7FKt9trHP_-JisgI';

export const isSupabaseConfigured = () => {
    // Check if the URL is a valid Supabase URL and not a placeholder
    return SUPABASE_URL.includes('supabase.co') && 
           !SUPABASE_URL.includes('placeholder-project');
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true 
    }
});