const getCurrentPosition = (): Promise<GeolocationPosition> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS를 지원하지 않는 브라우저예요"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        switch(error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error("위치 권한을 허용해주세요"));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error("위치 정보를 가져올 수 없어요"));
            break;
          case error.TIMEOUT:
            reject(new Error("위치 요청 시간이 초과됐어요. 다시 시도해주세요."));
            break;
        }
      },
      {
        enableHighAccuracy: false, // ← true → false 변경
        timeout: 30000,            // ← 10000 → 30000 변경
        maximumAge: 60000,         // ← 0 → 60000 변경
      }
    );
  });
};