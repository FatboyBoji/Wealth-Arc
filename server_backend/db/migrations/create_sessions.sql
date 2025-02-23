DROP TABLE IF EXISTS public.user_sessions_wa;

CREATE TABLE IF NOT EXISTS public.user_sessions_wa (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_id VARCHAR(255) NOT NULL,
    device_info TEXT,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(token_id)
);

CREATE INDEX idx_user_sessions_wa_user_id ON public.user_sessions_wa(user_id);
CREATE INDEX idx_user_sessions_wa_token_id ON public.user_sessions_wa(token_id); 