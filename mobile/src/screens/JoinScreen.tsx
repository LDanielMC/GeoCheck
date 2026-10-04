import React, { useCallback, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useBackHandler } from "../hooks/useBackHandler";
import { joinWithCode } from "../services/authService";
import { errorMessage } from "../services/errors";
import { Button, ErrorText, Field, FormScreen, LinkButton } from "../ui";

export default function JoinScreen({ onBack }: { onBack: () => void }) {
  const { signIn } = useAuth();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useBackHandler(useCallback(() => onBack(), [onBack]));

  const handleJoin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(await joinWithCode({ code: code.trim(), name, email: email.trim(), password }));
    } catch (e) {
      setError(errorMessage(e, "No se pudo unir a la organización"));
      setLoading(false);
    }
  };

  const incomplete = !code.trim() || !name.trim() || !email.trim() || !password;

  return (
    <FormScreen title="Unirme con código" subtitle="Pide el código de invitación a tu administrador.">
      <Field
        label="Código de invitación"
        placeholder="ABCD-EFGH"
        autoCapitalize="characters"
        autoCorrect={false}
        value={code}
        onChangeText={setCode}
      />
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
      <Button title="Unirme" onPress={handleJoin} loading={loading} disabled={incomplete} />
      <LinkButton title="Ya tengo cuenta" onPress={onBack} />
    </FormScreen>
  );
}
