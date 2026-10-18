import { beforeEach, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ReportAnswerButton } from "../../src/ask/ReportAnswerButton";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { report_ai_answer } from "../../src/api/voticApi";

jest.mock("../../src/api/voticApi", () => ({ report_ai_answer: jest.fn() }));
const report = jest.mocked(report_ai_answer);
beforeEach(() => {
  report.mockReset();
});

async function open_report() {
  await render(
    <ThemeProvider>
      <ReportAnswerButton answer="Selected AI answer" />
    </ThemeProvider>,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Report answer" }));
}

it("requires a reason and explicit consent before sharing the selected answer", async () => {
  report.mockResolvedValue(undefined);
  await open_report();
  expect(screen.getByRole("button", { name: "Send report" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("radio", { name: "Harmful or unsafe" }));
  expect(screen.getByRole("button", { name: "Send report" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("checkbox"));
  await fireEvent.press(screen.getByRole("button", { name: "Send report" }));
  expect(report).toHaveBeenCalledTimes(1);
  expect(report).toHaveBeenCalledWith("Selected AI answer", "harmful");
  expect(screen.getByRole("header", { name: "Report received" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Done" }));
  expect(screen.getByRole("button", { name: "Answer reported" })).toBeDisabled();
});

it("can cancel without sending and retry an unsuccessful report inside the app", async () => {
  report.mockRejectedValueOnce(new Error("Service unavailable"));
  report.mockResolvedValueOnce(undefined);
  await open_report();
  await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
  expect(report).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Report answer" }));
  await fireEvent.press(screen.getByRole("radio", { name: "Inaccurate or misleading" }));
  await fireEvent.press(screen.getByRole("checkbox"));
  await fireEvent.press(screen.getByRole("button", { name: "Send report" }));
  expect(screen.getByRole("alert").props.children).toBe("Service unavailable");
  await fireEvent.press(screen.getByRole("button", { name: "Send report" }));
  expect(report).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("header", { name: "Report received" })).toBeTruthy();
});
