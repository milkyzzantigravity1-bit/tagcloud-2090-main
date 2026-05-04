declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      user: { id: string; email: string } | null;
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
