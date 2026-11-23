// @spark/core: client-safe entry (types, config, data store, UI, shell, people, auth screens).
// Server-only code (routes, proxy, admin client) is in "@spark/core/server" and "@spark/core/routes/*".
export * from "./config";
export * from "./data/sync";
export * from "./data/DataProvider";
export * from "./people/data";
export * from "./people/invites";
export * from "./people/Dashboard";
export * from "./people/InviteAction";
export * from "./people/TeamsGrid";
export * from "./people/UserDetail";
export * from "./people/UserForm";
export * from "./people/UsersTable";
export * from "./ui/ui";
export * from "./ui/MultiSelect";
export * from "./shell/AppShell";
export * from "./shell/PageTabs";
export * from "./shell/Sidebar";
export * from "./shell/SparkProvider";
export * from "./auth-ui/LoginForm";
export * from "./auth-ui/RegisterForm";
export * from "./auth-ui/UpdatePasswordForm";
export * from "./supabase/env";
export * from "./supabase/client";
