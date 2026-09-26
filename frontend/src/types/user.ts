export interface User {
  id: number;
  email: string;
  name: string | null;
  birth_date: string | null; // AAAA-MM-DD
  // Foto como data URL, pronta para o <img src>; null sem foto
  avatar_url: string | null;
  created_at: string;
}

export interface ProfileFields {
  name: string;
  email: string;
  birth_date: string | null;
  // Só é exigida para trocar o e-mail
  current_password?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
