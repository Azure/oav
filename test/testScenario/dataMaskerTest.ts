// Copyright (c) 2021 Microsoft Corporation
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
import { DataMasker, DataMaskerOption, defaultMaskValue } from "../../lib/testScenario/dataMasker";
import { inversifyGetInstance } from "../../lib/inversifyUtils";

describe("dataMasker", () => {
  const dataMaskerOption: DataMaskerOption = {
    maskValue: defaultMaskValue,
  };
  const dataMasker = inversifyGetInstance(DataMasker, dataMaskerOption);
  it("Should mask value by key", () => {
    const obj = { password: "xxx", userInfo: { passWord: "user password" } };
    const ret = dataMasker.maskObject(obj);
    expect(ret).toEqual({ password: "<masked>", userInfo: { passWord: "<masked>" } });
  });

  it("Should mask value by value", () => {
    const obj = {
      request: {
        body: {},
        headers: {
          // This bearer token is a expired token.
          bearer:
            "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6Im5PbzNaRHJPRFhFSzFqS1doWHNsSFJfS1hFZyIsImtpZCI6Im5PbzNaRHJPRFhFSzFqS1doWHNsSFJfS1hFZyJ9.eyJhdWQiOiJodHRwczovL21hbmFnZW1lbnQuYXp1cmUuY29tIiwiaXNzIjoiaHR0cHM6Ly9zdHMud2luZG93cy5uZXQvNzJmOTg4YmYtODZmMS00MWFmLTkxYWItMmQ3Y2QwMTFkYjQ3LyIsImlhdCI6MTYyMDYxMzY4MiwibmJmIjoxNjIwNjEzNjgyLCJleHAiOjE2MjA3MDAzODIsImFpbyI6IkUyWmdZUEJyM3JiUk1IcjJjZUVTbit1SkxHOW5BUUE9IiwiYXBwaWQiOiI0MGZkZDBhOC05NDkxLTQxM2YtYjVkYy04NmRhNzI4MTU3NzMiLCJhcHBpZGFjciI6IjEiLCJpZHAiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC83MmY5ODhiZi04NmYxLTQxYWYtOTFhYi0yZDdjZDAxMWRiNDcvIiwib2lkIjoiMGEzMmM5ODAtODYwMS00NDZjLTg0M2UtOTQxMWE4ZjU4NmM3IiwicmgiOiIwLkFRRUF2NGo1Y3ZHR3IwR1JxeTE4MEJIYlI2alFfVUNSbEQ5QnRkeUcybktCVjNNYUFBQS4iLCJzdWIiOiIwYTMyYzk4MC04NjAxLTQ0NmMtODQzZS05NDExYThmNTg2YzciLCJ0aWQiOiI3MmY5ODhiZi04NmYxLTQxYWYtOTFhYi0yZDdjZDAxMWRiNDciLCJ1dGkiOiJmSVRlYWJCaHJFR0ctbHFIdzlNTUFBIiwidmVyIjoiMS4wIiwieG1zX3RjZHQiOjEyODkyNDE1NDd9.NdtNQAcjs82WIAwfUiDRwJH9EUWmr6nli5sC1CVVokM8etGv2Kq3YMB4i3TGRhGjnfD7Uv2QlyHfOtbpZVsAINUohUiXg9iID4xRJd-PouJ-HF0kmMwyl0LF0wvtxlPO70Is6OMRp_Q0dAKSrcnHTFLfTGhaBFgqS_ht6sbv2ABbEBvLt0c53AFMGZrzyz0sNAEd0mZfbN8_Eo2gBBlk1rVyRjBaCi26wWaeExfDS_Gx1H5fnlHzBfEqsTio-Kmzc3HeFayy_9fk60xHlfTb-KLa6lPNZGo87H_P0N5v2jo8HHD3N9SLXegvBC8IrRQwAkP3cVS_20Z-xuPLIw7crA",
        },
      },
    };
    const ret = dataMasker.maskObject(obj);
    expect(ret).toEqual({ request: { body: {}, headers: { bearer: "<masked>" } } });
  });

  it("Mask obj with 'addMaskedValue' option", () => {
    const obj = {
      userInfo: {
        password: "eyJ0eXAiOiJKV1QiLCJhbGc",
        db: "db://eyJ0eXAiOiJKV1QiLCJhbGc@fake.sql.com",
      },
    };
    const ret = dataMasker.maskObject(obj, true);
    expect(ret).toEqual({
      userInfo: {
        password: "<masked>",
        db: "db://eyJ0eXAiOiJKV1QiLCJhbGc@fake.sql.com",
      },
    });
    const content = dataMasker.jsonStringify(obj);
    expect(content).toEqual(
      JSON.stringify(
        {
          userInfo: {
            password: "<masked>",
            db: "db://<masked>@fake.sql.com",
          },
        },
        null,
        2
      )
    );
  });
});
