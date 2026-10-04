import React, { useCallback, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useBackHandler } from "../hooks/useBackHandler";
import { registerOrganization } from "../services/authService";
import { errorMessage } from "../services/errors";
import { Button, ErrorText, Field, FormScreen, LinkButton } from "../ui";

export default function RegisterOrganizationScreen({ onBack }: { onBack: () => void }) {
  const { signIn } = useAuth();
  const [organizationName, setOrganizationName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBackHandler(useCallback(() => onBack(), [onBack]));

  const handleRegister = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(await registerOrganization({ organizationName, name, email: email.trim(), password }));
    } catch (e) {
      setError(errorMessage(e, "No se pudo crear la organización"));
      setLoading(false);
    }
  };

  const incomplete = !organizationName.trim() || !name.trim() || !email.trim() || !password;

  return (
    <FormScreen title="Crear organización" subtitle="Serás el administrador y podrás invitar a tu equipo.">
      <Field label="Nombre de la empresa" value={organizationName} onChangeText={setOrganizationName} />
      <Field label="Tu nombre" autoComplete="name" value={name} onChangeText={setName} />
      <Field
        label="Correo electrónico"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label="Contraseña (mínimo 8 caracteres)"
        secureTextEntry
        autoComplete="password-new"
        value={password}
        onChangeText={setPassword}
      />
      <ErrorText message={error} />
      <Button title="Crear organización" onPress={handleRegister} loading={loading} disabled={incomplete} />
      <LinkButton title="Ya tengo cuenta" onPress={onBack} />
    </FormScreen>
  );
}
