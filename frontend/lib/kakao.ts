const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export const getAddressFromCoords = async (
  latitude: number,
  longitude: number
): Promise<string> => {
  try {
    const response = await fetch(
      `${API_URL}/api/location/address?lat=${latitude}&lng=${longitude}`
    );
    const data = await response.json();
    return data.address;
  } catch (error) {
    console.error("주소 변환 실패:", error);
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
};