import { useState } from "react";
import { supabase } from "./supabase";
import { Turnstile } from "@marsidev/react-turnstile";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState("");

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  async function handleSubmit() {
    setMessage("");

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          captchaToken: captchaToken ?? undefined,
        },
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("Connexion réussie");
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
          captchaToken: captchaToken ?? undefined,
        },
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(
        "Compte créé. Vérifie éventuellement ton email pour confirmer ton inscription.",
      );
    }
  }

  return (
    <div className="auth-panel">
      <h2>{isLogin ? "Connexion" : "Créer un compte"}</h2>

      {!isLogin && (
        <input
          type="text"
          placeholder="Pseudo"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      )}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <input
        type="password"
        placeholder="Mot de passe"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      <Turnstile
        siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
        onSuccess={(token) => {
          setCaptchaToken(token);
        }}
        onExpire={() => {
          setCaptchaToken(null);
        }}
      />

      <button onClick={handleSubmit} disabled={!captchaToken}>
        {isLogin ? "Se connecter" : "Créer mon compte"}
      </button>

      <button type="button" onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? "Je n'ai pas encore de compte" : "J'ai déjà un compte"}
      </button>

      {message && <p>{message}</p>}
    </div>
  );
}
