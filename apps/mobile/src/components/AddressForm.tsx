import { View, Text, Linking } from "react-native";
import * as Location from "expo-location";
import { Input, Button, s } from "./ui";
import type { Address } from "../../../../shared/types";
export const blankAddress: Address = {
  name: "",
  phone: "",
  line1: "",
  city: "",
  state: "",
  pincode: "",
};
export default function AddressForm({
  value,
  onChange,
  onError,
}: {
  value: Address;
  onChange: (a: Address) => void;
  onError: (e: string) => void;
}) {
  async function locate() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted")
        throw new Error(
          "Location access was declined. You can enter your address manually.",
        );
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      onChange({
        ...value,
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    } catch (e) {
      onError((e as Error).message);
    }
  }
  return (
    <View>
      {(
        [
          ["name", "Recipient name"],
          ["phone", "Phone"],
          ["line1", "Street address"],
          ["city", "City"],
          ["state", "State"],
          ["pincode", "PIN code"],
        ] as const
      ).map(([key, label]) => (
        <Input
          key={key}
          label={label}
          value={value[key]}
          onChangeText={(v) => onChange({ ...value, [key]: v })}
          keyboardType={
            key === "phone" || key === "pincode" ? "phone-pad" : "default"
          }
          maxLength={key === "pincode" ? 6 : 200}
        />
      ))}
      <Button title="Use my delivery location" secondary onPress={locate} />
      {value.lat !== undefined && value.lng !== undefined && (
        <>
          <Text style={[s.small, { marginTop: 10 }]}>
            Pin: {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </Text>
          <Button
            title="View delivery pin on OpenStreetMap"
            secondary
            onPress={() => {
              void Linking.openURL(
                `https://www.openstreetmap.org/?mlat=${value.lat}&mlon=${value.lng}#map=17/${value.lat}/${value.lng}`,
              );
            }}
          />
        </>
      )}
    </View>
  );
}
