import React, { useEffect, useState } from "react";
import { BackHandler, StyleSheet, View } from "react-native";
import { Banner, colors, spacing } from "../design";
import { useAuth } from "../context/AuthContext";
import HomeScreen from "../screens/HomeScreen";
import InfoScreen from "../screens/InfoScreen";
import InvitationsScreen from "../screens/InvitationsScreen";
import MoreScreen from "../screens/MoreScreen";
import ProjectFormScreen from "../screens/ProjectFormScreen";
import ProjectsScreen from "../screens/ProjectsScreen";
import RecordsScreen from "../screens/RecordsScreen";
import TeamScreen from "../screens/TeamScreen";
import { texts } from "../texts";
import { ROLE_LABELS, type Project, type SessionUser } from "../types";
import { back, initialNav, pop, push, selectTab, showsTabBar, validNav, type NavState, type PushedScreen } from "./navState";
import { TabBar } from "./TabBar";
import { tabsForRole, type TabId } from "./tabs";

// Estructura de la app con sesión: contenido arriba y barra de pestañas abajo, según el rol. El botón «atrás» de Android
// lo atiende solo este componente (las pantallas no registran el suyo).
export default function Shell({ user, offline }: { user: SessionUser; offline: boolean }) {
  const { refresh } = useAuth();
  const [stored, setNav] = useState<NavState>(() => initialNav(user.role));
  // Si el servidor cambia el rol, la pestaña actual puede dejar de existir: se corrige al dibujar.
  const nav = validNav(stored, user.role);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      const result = back(nav, user.role);
      if (!result.handled) return false;
      setNav(result.state);
      return true;
    });
    return () => subscription.remove();
  }, [nav, user.role]);

  const top = nav.stack.at(-1);

  return (
    <View style={styles.container}>
      {offline ? (
        <View style={styles.offline}>
          <Banner message={texts.common.offlineBanner} actionLabel={texts.common.retry} onAction={() => void refresh()} />
        </View>
      ) : null}
      <View style={styles.content}>
        {top ? (
          <PushedContent screen={top} user={user} onBack={() => setNav(pop(nav))} />
        ) : (
          <TabContent
            tab={nav.tab}
            user={user}
            onOpenProject={(project) => setNav(push(nav, { name: "project", project }))}
            onOpenProfile={() => setNav(push(nav, { name: "profile" }))}
            onOpenCompany={() => setNav(push(nav, { name: "company" }))}
          />
        )}
      </View>
      {showsTabBar(nav) ? <TabBar tabs={tabsForRole(user.role)} active={nav.tab} onSelect={(tab) => setNav(selectTab(nav, tab, user.role))} /> : null}
    </View>
  );
}

function TabContent({
  tab,
  user,
  onOpenProject,
  onOpenProfile,
  onOpenCompany,
}: {
  tab: TabId;
  user: SessionUser;
  onOpenProject: (project: Project | null) => void;
  onOpenProfile: () => void;
  onOpenCompany: () => void;
}) {
  switch (tab) {
    case "home":
      return <HomeScreen />;
    case "projects":
      return <ProjectsScreen user={user} onOpenProject={onOpenProject} />;
    case "records":
      return <RecordsScreen />;
    case "team":
      // Solo el ADMIN invita; el servidor lo exige igualmente (403 para los demás roles).
      return user.role === "ADMIN" ? <InvitationsScreen user={user} /> : <TeamScreen />;
    case "more":
      return <MoreScreen user={user} onOpenProfile={onOpenProfile} onOpenCompany={onOpenCompany} />;
  }
}

function PushedContent({ screen, user, onBack }: { screen: PushedScreen; user: SessionUser; onBack: () => void }) {
  switch (screen.name) {
    // Los demás roles ven el proyecto en solo lectura; crear o editar lo exige también el servidor (403).
    case "project":
      return <ProjectFormScreen user={user} project={screen.project} onBack={onBack} />;
    case "profile":
      return (
        <InfoScreen
          title={texts.profile.title}
          onBack={onBack}
          rows={[
            { label: texts.profile.name, value: user.name },
            { label: texts.profile.email, value: user.email },
            { label: texts.profile.role, value: ROLE_LABELS[user.role] },
            { label: texts.profile.company, value: user.organization.name },
          ]}
        />
      );
    case "company":
      return (
        <InfoScreen
          title={texts.company.title}
          onBack={onBack}
          rows={[
            { label: texts.company.name, value: user.organization.name },
            { label: texts.company.yourRole, value: ROLE_LABELS[user.role] },
          ]}
        />
      );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  offline: { padding: spacing.md, backgroundColor: colors.paper },
  content: { flex: 1 },
});
