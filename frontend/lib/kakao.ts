export const getAddressFromCoords = async (
  latitude: number,
  longitude: number
): Promise<string> => {
  try {
    const response = await fetch(
      `http://127.0.0.1:8000/api/location/address?lat=${latitude}&lng=${longitude}`
    );
    const data = await response.json();
    return data.address;
  } catch (error) {
    console.error("주소 변환 실패:", error);
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  }
};