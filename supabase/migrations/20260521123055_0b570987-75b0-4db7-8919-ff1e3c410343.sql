CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "strategies viewable by authenticated"
  ON public.strategies FOR SELECT TO authenticated USING (true);

CREATE POLICY "users insert own strategies"
  ON public.strategies FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own strategies"
  ON public.strategies FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users delete own strategies"
  ON public.strategies FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "admins manage strategies"
  ON public.strategies FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_strategies_updated_at
  BEFORE UPDATE ON public.strategies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_strategies_user_id ON public.strategies(user_id);
CREATE INDEX idx_strategies_updated_at ON public.strategies(updated_at DESC);