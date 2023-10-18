# This script is used to invoke oav (examples AND specification) against every specification
# discovered within a target repo.
#
# It is intended to be used twice, with different invoking versions of oav.
#
# FOR COMPATIBILITY The script expects that:
#   - node 16+ is on the PATH


import glob
import argparse
import os
import shutil
import sys
import tempfile
import difflib
from dataclasses import dataclass

import subprocess
from typing import List, Dict, Tuple

CACHE_FILE_NAME: str = ".spec_cache"


@dataclass
class OAVScanResult:
    """Used to track the results of an oav invocation"""

    target_folder: str
    stdout: str
    stderr: str
    success: int
    oav_version: str

    @property
    def stdout_length_in_bytes(self) -> int:
        return os.path.getsize(self.stdout)

    @property
    def stderr_length_in_bytes(self) -> int:
        return os.path.getsize(self.stderr)


def get_oav_output(
    oav_exe: str,
    target_folder: str,
    collection_std_out: str,
    collection_std_err: str,
    oav_command: str,
    oav_version: str,
) -> OAVScanResult:
    try:
        with open(collection_std_out, "w", encoding="utf-8") as out, open(
            collection_std_err, "w", encoding="utf-8"
        ) as err:
            print([oav_exe, oav_command, target_folder])
            result = subprocess.run(
                [oav_exe, oav_command, target_folder], stdout=out, stderr=err, check=True, shell=True
            )

        return OAVScanResult(target_folder, collection_std_out, collection_std_err, result.returncode, oav_version)
    except subprocess.CalledProcessError as e:
        with open(collection_std_err, "a", encoding="utf-8") as err:
            err.write(str(e))

        return OAVScanResult(target_folder, collection_std_out, collection_std_err, -1, oav_version)


def is_word_present_in_file(file_path, word):
    try:
        with open(file_path, "rb") as file:
            first_bytes = file.read(20)
            return word in first_bytes
    except Exception as e:
        return False


def get_specification_files(target_folder: str, output_folder: str) -> List[str]:
    target = os.path.join(target_folder, "specification", "**", "*.json")
    jsons = glob.glob(target, recursive=True)
    search_word = b"swagger"
    specs = []
    num = len(jsons)

    output_cache = os.path.join(output_folder, CACHE_FILE_NAME)

    if os.path.exists(output_cache):
        with open(output_cache, "r", encoding="utf-8") as c:
            specs = c.readlines()
            return [spec.strip() for spec in specs]

    print(f"Scanned directory, found {len(jsons)} json files.")

    for index, json_file in enumerate(jsons):
        if is_word_present_in_file(json_file, search_word):
            specs.append(json_file)
        print(f"{index} / {num}")

    print(f"Filtered to {len(specs)} swagger files.")
    with open(output_cache, "w", encoding="utf-8") as c:
        c.write("\n".join(specs))

    return specs


def verify_oav_version(oav: str) -> str:
    try:
        result = subprocess.run([oav, "--version"], capture_output=True, shell=True)
        return result.stdout.decode("utf-8").strip()
    except Exception as f:
        return "-1"


def get_output_files(root_target_folder: str, choice: str, target_folder: str) -> Tuple[str, str]:
    """Given the root of the azure-rest-api-specs repo AND a folder that is some deeper child of that,
    come up with the output file names"""

    relpath = os.path.relpath(target_folder, root_target_folder)
    flattened_path = relpath.replace("\\", "_").replace("/", "_").replace(".json", "")

    return (f"{flattened_path}_{choice}_out.log", f"{flattened_path}_{choice}_err.log")


def prepare_output_folder(target_folder: str) -> str:
    must_repopulate_cache = False

    if os.path.exists(target_folder):
        cache_file = os.path.join(target_folder, CACHE_FILE_NAME)
        if os.path.exists(cache_file):
            tmp_dir = tempfile.gettempdir()
            cache_location = os.path.join(tmp_dir, CACHE_FILE_NAME)
            shutil.move(cache_file, cache_location)
            must_repopulate_cache = True

        shutil.rmtree(target_folder)

    os.makedirs(target_folder)

    if must_repopulate_cache:
        shutil.move(cache_location, cache_file)

    return target_folder


def dump_summary(summary: Dict[str, OAVScanResult]) -> None:
    print(f"Scanned {len(summary.keys())} files successfully.")


def run(oav_exe: str, spec: str, output_folder: str, choice: str, oav_version: str):
    collection_stdout_file, collection_stderr_file = get_output_files(args.target, choice, spec)
    resolved_out = os.path.join(output_folder, collection_stdout_file)
    resolved_err = os.path.join(output_folder, collection_stderr_file)
    summary[f"{spec}-{choice}"] = get_oav_output(oav_exe, spec, resolved_out, resolved_err, choice, oav_version)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scan azure-rest-api-specs repository, invoke oav")

    parser.add_argument(
        "--target",
        dest="target",
        help="The azure-rest-api-specs repo root.",
        required=True,
    )

    parser.add_argument(
        "--output",
        dest="output",
        help="The folder which will contain the oav output.",
        required=True,
    )

    parser.add_argument(
        "--type",
        dest="type",
        required=True,
        help="Are we running specs or examples?",
        choices=["validate-spec","validate-example"]
    )

    parser.add_argument(
        "--oav",
        dest="oav",
        help="The oav exe this script will be using! If OAV is on the PATH just pass nothing!",
        required=False
    )


    args = parser.parse_args()

    if args.oav:
        oav_exe = args.oav
    else:
        oav_exe = "oav"

    oav_version = verify_oav_version(oav_exe)

    if oav_version == "-1":
        print("OAV is not available on the PATH. Resolve this ane reinvoke.")
        sys.exit(1)

    output_folder: str = prepare_output_folder(args.output)
    specs: List[str] = get_specification_files(args.target, output_folder)
    summary: Dict[str, OAVScanResult] = {}

    for spec in specs:
        run(oav_exe, spec, output_folder, args.type, oav_version)

    dump_summary(summary)
