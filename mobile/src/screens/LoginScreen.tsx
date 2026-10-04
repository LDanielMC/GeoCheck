import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { login } from "../services/authService";
import { errorMessage } from "../services/errors";
import { Button, ErrorText, Field, FormScreen, LinkButton } from "../ui";

export default function LoginScreen({ onRegister, onJoin }: { onRegister: () => void; onJoin: () => void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(await login(email.trim(), password));
    } catch (e) {
      setError(errorMessage(e, "No se pudo iniciar sesión"));
      setLoading(false);
    }
  };

  return (
    <FormScreen title="GeoCheck" subtitle="Control de horas por ubicación">
      <Field
        label="Correo electrónico"
        placeholder="tu@correo.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label="Contraseña"
        placeholder="Contraseña"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />
      <ErrorText message={error} />
      <Button title="Iniciar sesión" onPress={handleLogin} loading={loading} disabled={!email.trim() || !password} />
      <LinkButton title="Tengo un código de invitación" onPress={onJoin} />
      <LinkButton title="Crear una organización nueva" onPress={onRegister} />
    </FormScreen>
  );
}
