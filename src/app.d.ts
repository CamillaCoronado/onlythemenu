declare global {
  namespace App {
    interface Locals {
      uid: string | null;
      isAdmin: boolean;
    }
  }
}
export {};
