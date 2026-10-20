"""Regression tests for the Android smoke check, including the recorded launcher ANR."""
import importlib.util
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("smoke_screen", ROOT / "security/android-smoke-screen.py")
screen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(screen)

WELCOME = '''<hierarchy><node package="com.votic.app" content-desc="Votic logo"/>
<node package="com.votic.app" text="Sign in"/></hierarchy>'''
LAUNCHER = '''<hierarchy><node package="android" resource-id="android:id/alertTitle" text="Quickstep isn't responding"/>
<node package="android" resource-id="android:id/aerr_close" enabled="true" bounds="[70,1143][1010,1269]"/></hierarchy>'''


class ScreenTests(unittest.TestCase):
    def test_only_the_known_launcher_dialog_is_recoverable(self):
        self.assertEqual(screen.classify_screen(LAUNCHER), "launcher-anr 540 1206")
        for other in ("Votic", "System UI", "Unknown app"):
            self.assertEqual(screen.classify_screen(LAUNCHER.replace("Quickstep", other)), "blocked")
        self.assertEqual(screen.classify_screen(LAUNCHER.replace('enabled="true"', 'enabled="false"')), "blocked")
        self.assertEqual(screen.classify_screen(LAUNCHER.replace("[70,1143][1010,1269]", "invalid")), "blocked")

    def test_readiness_requires_votic_ui_and_valid_xml(self):
        self.assertEqual(screen.classify_screen(WELCOME), "ready")
        self.assertEqual(screen.classify_screen(WELCOME.replace("com.votic.app", "another.app")), "wait")
        self.assertEqual(screen.classify_screen(WELCOME.replace("Sign in", "Loading")), "wait")
        for malformed in ("", "not XML", "<hierarchy>"):
            self.assertEqual(screen.classify_screen(malformed), "wait")


class ShellTests(unittest.TestCase):
    def run_smoke(self, scenario):
        with tempfile.TemporaryDirectory(prefix="votic-smoke-") as directory:
            root = Path(directory)
            bin_dir = root / "bin"
            bin_dir.mkdir()
            adb = bin_dir / "adb"
            adb.write_text('''#!/usr/bin/env python3
import os, sys
from pathlib import Path
args = sys.argv[1:]
scenario = os.environ["SMOKE_SCENARIO"]
root = Path(os.environ["SMOKE_ROOT"])
with (root / "commands.txt").open("a") as f: f.write(" ".join(args) + "\\n")
if args[:2] == ["exec-out", "cat"]:
    count_file = root / "dumps"
    count = int(count_file.read_text()) if count_file.exists() else 0
    count_file.write_text(str(count + 1))
    if scenario in ("launcher", "repeated") and (count == 0 or scenario == "repeated"):
        print(os.environ["LAUNCHER_XML"])
    elif scenario == "app-anr":
        print(os.environ["LAUNCHER_XML"].replace("Quickstep", "Votic"))
    elif scenario == "missing-ui":
        print("<hierarchy/>")
    elif scenario == "malformed" and count == 0:
        print("incomplete dump")
    else:
        print(os.environ["WELCOME_XML"])
elif args[:3] == ["shell", "dumpsys", "package"]:
    print("com.votic.widgets.ContinueWidgetProvider")
    if scenario != "missing-widget": print("com.votic.widgets.WeekWidgetProvider")
elif args[:2] == ["shell", "pidof"]:
    if scenario == "dead-process": sys.exit(1)
    print("1234")
elif args[:1] == ["logcat"] and "-d" in args and scenario == "fatal":
    print("FATAL EXCEPTION: main\\nProcess: com.votic.app")
''')
            adb.chmod(0o755)
            sleep = bin_dir / "sleep"
            sleep.write_text("#!/usr/bin/env bash\nexit 0\n")
            sleep.chmod(0o755)
            result = subprocess.run(
                ["bash", str(ROOT / "security/android-smoke.sh"), "fixture.apk"],
                cwd=root, text=True, capture_output=True, timeout=15,
                env={**os.environ, "PATH": str(bin_dir) + os.pathsep + os.environ["PATH"],
                     "SMOKE_ROOT": str(root), "SMOKE_SCENARIO": scenario,
                     "LAUNCHER_XML": LAUNCHER, "WELCOME_XML": WELCOME},
            )
            commands = (root / "commands.txt").read_text()
            # Failure evidence must survive every outcome, including an early blocked-dialog exit.
            for name in ("android-smoke-screen.png", "android-smoke-diagnostics.txt", "android-smoke-anr.txt"):
                self.assertTrue((root / name).exists(), name)
            return result, commands

    def test_recovers_launcher_once_and_checks_the_actual_app(self):
        result, commands = self.run_smoke("launcher")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(commands.count("shell input tap 540 1206"), 1)
        self.assertEqual(commands.count("shell am start -W"), 2)
        self.assertIn("shell pidof com.votic.app", commands)
        self.assertIn("shell dumpsys package com.votic.app", commands)

    def test_healthy_app_and_transient_bad_dump_pass_without_tapping(self):
        for scenario in ("healthy", "malformed"):
            with self.subTest(scenario=scenario):
                result, commands = self.run_smoke(scenario)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertNotIn("shell input tap", commands)

    def test_real_failures_are_not_hidden_by_recovery(self):
        for scenario in ("repeated", "app-anr", "fatal", "missing-widget", "missing-ui", "dead-process"):
            with self.subTest(scenario=scenario):
                result, commands = self.run_smoke(scenario)
                self.assertNotEqual(result.returncode, 0)
                self.assertLessEqual(commands.count("shell input tap"), 1)
                if scenario != "repeated": self.assertNotIn("shell input tap", commands)


if __name__ == "__main__":
    unittest.main()
