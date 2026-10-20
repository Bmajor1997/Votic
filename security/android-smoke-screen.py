#!/usr/bin/env python3
"""Classify the foreground smoke-test UI without dismissing application failures."""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def classify_screen(xml):
    try:
        nodes = list(ET.fromstring(xml).iter("node"))
    except ET.ParseError:
        return "wait"

    titles = [n.get("text", "") for n in nodes
              if n.get("package") == "android" and n.get("resource-id") == "android:id/alertTitle"]
    # This exact first-boot launcher ANR was recorded by run 39463987567.
    # Never close a Votic, System UI, or unknown application's error dialog.
    if titles == ["Quickstep isn't responding"]:
        for node in nodes:
            if (node.get("package") == "android"
                    and node.get("resource-id") == "android:id/aerr_close"
                    and node.get("enabled") == "true"):
                bounds = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
                if bounds:
                    left, top, right, bottom = map(int, bounds.groups())
                    if right > left and bottom > top:
                        return f"launcher-anr {(left + right) // 2} {(top + bottom) // 2}"
        return "blocked"
    if any("isn't responding" in title or "keeps stopping" in title for title in titles):
        return "blocked"

    labels = " ".join(n.get("text", "") + " " + n.get("content-desc", "")
                      for n in nodes if n.get("package") == "com.votic.app")
    if "Votic" in labels and any(text in labels for text in ("Sign in", "Get started", "Create account")):
        return "ready"
    return "wait"


if __name__ == "__main__":
    print(classify_screen(Path(sys.argv[1]).read_text()))
