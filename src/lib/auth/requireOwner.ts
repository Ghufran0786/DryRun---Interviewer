import {
  requireUser,
  type UserContext,
} from "@/lib/auth/requireUser";

export type OwnerContext = UserContext;

/** @deprecated Use requireUser */
export const requireOwner = requireUser;
