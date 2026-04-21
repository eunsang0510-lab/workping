const handleGoogleLogin = async () => {
  setLoading(true);
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // DB에 유저 정보 저장
    const res = await fetch(`${API_URL}/api/auth/upsert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        name: user.displayName || "",
      }),
    });

    router.push("/dashboard");
  } catch (error) {
    console.error("로그인 실패:", error);
  } finally {
    setLoading(false);
  }
};