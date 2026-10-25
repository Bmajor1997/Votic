import AsyncStorage from "@react-native-async-storage/async-storage";
import { expect, it } from "@jest/globals";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import SignIn from "../../app/sign-in";
import { REMEMBERED_EMAIL_KEY, remembered_sign_in_email } from "../../src/auth/rememberedEmail";
import { erase_local_account } from "../../src/storage/accountDeletion";
import { fakeAuth } from "../mocks/authBackend";
import { searchParams } from "../mocks/expoRouter";
import { render_with_providers } from "../renderWithProviders";

async function sign_in_with_email() {
  fakeAuth.reset(null);
  fakeAuth.accounts.set("reader@example.com", "reading1");
  await render_with_providers(<SignIn />);
  await fireEvent.changeText(screen.getByLabelText("Email"), "reader@example.com");
  await fireEvent.changeText(screen.getByLabelText("Password"), "reading1");
  await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
  await waitFor(async () => expect(await remembered_sign_in_email()).toBe("reader@example.com"));
}

it("fills in the last email after signing out, but never the password", async () => {
  await sign_in_with_email();
  await act(async () => fakeAuth.setUser(null));
  screen.unmount();
  await render_with_providers(<SignIn />);
  await waitFor(() => expect(screen.getByLabelText("Email").props.value).toBe("reader@example.com"));
  expect(screen.getByLabelText("Password").props.value).toBe("");
  expect(await AsyncStorage.getItem(REMEMBERED_EMAIL_KEY)).not.toContain("reading1");
});

it("keeps the email-and-password account's email when someone signs in with Google", async () => {
  await sign_in_with_email();
  await act(async () => fakeAuth.setUser({ uid: "google", email: "g@example.com", displayName: "G" }));
  expect(await remembered_sign_in_email()).toBe("reader@example.com");
});

it("uses an email handed to Sign in instead of the remembered one", async () => {
  await sign_in_with_email();
  await act(async () => fakeAuth.setUser(null));
  screen.unmount();
  searchParams.current = { email: "other@example.com" };
  await render_with_providers(<SignIn />);
  await act(async () => {});
  expect(screen.getByLabelText("Email").props.value).toBe("other@example.com");
});

it("forgets the email when that account is deleted from this device, and only then", async () => {
  await sign_in_with_email();
  await erase_local_account("someone-else");
  expect(await remembered_sign_in_email()).toBe("reader@example.com");
  await erase_local_account("user-reader@example.com");
  expect(await remembered_sign_in_email()).toBe("");
});
