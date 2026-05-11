"use client";
import { useEffect } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function AuthRedirect() {
  const router = useRouter();
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) router.push("/dashboard");
    });
    return () => unsubscribe();
  }, [router]);
  return null;
}
