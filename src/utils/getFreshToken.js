// src/utils/getFreshToken.js
import { getAuth } from 'firebase/auth';

export const getFreshToken = async () => {
  const currentUser = getAuth().currentUser;
  if (!currentUser) throw new Error("Usuario no autenticado");
  return await currentUser.getIdToken(true);
};
