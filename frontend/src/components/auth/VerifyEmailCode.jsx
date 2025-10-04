// src/components/auth/VerifyEmailCode.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useSendVerificationCodeMutation, useVerifyEmailCodeMutation } from "../../redux/api/authApi";
import { userApi } from "../../redux/api/userApi";
import { useDispatch } from "react-redux";
import toast from "react-hot-toast";
import MetaData from "../layout/MetaData";

const COOLDOWN_SECONDS = 60;

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function getKey(email) {
  return `verifyCodeLastSend:${(email || "").toLowerCase()}`;
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

const VerifyEmailCode = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const initialEmail = query.get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");

  // cooldown state (seconds left)
  const [cooldownLeft, setCooldownLeft] = useState(0);

  const [sendCode, { isLoading: sending, error: sendErr, data: sendData }] =
    useSendVerificationCodeMutation();
  const [verifyCode, { isLoading: verifying, error: verifyErr, data: verifyData }] =
    useVerifyEmailCodeMutation();

  // Start/update cooldown from localStorage when email changes
  useEffect(() => {
    const k = getKey(email);
    const last = Number(localStorage.getItem(k) || 0);
    if (last) {
      const passed = nowSec() - last;
      const remain = Math.max(COOLDOWN_SECONDS - passed, 0);
      setCooldownLeft(remain);
    } else {
      setCooldownLeft(0);
    }
  }, [email]);

  // Tick the countdown every 1s while > 0
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const t = setInterval(() => {
      setCooldownLeft((s) => (s > 1 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownLeft]);

  const submitVerify = (e) => {
    e.preventDefault();
    if (!email || !code) return toast.error("Please fill email and code");
    verifyCode({ email, code });
  };

  const markCooldown = () => {
    const k = getKey(email);
    localStorage.setItem(k, String(nowSec()));
    setCooldownLeft(COOLDOWN_SECONDS);
  };

  const resend = async () => {
    if (!email) return toast.error("Enter your email");
    if (cooldownLeft > 0) return; // safety
    const res = await sendCode({ email });
    if ("data" in res && res.data?.success) {
      markCooldown();
    }
  };

  useEffect(() => {
    if (sendErr?.data?.message) toast.error(sendErr.data.message);
    if (sendData?.success) toast.success(sendData.message || "Code sent");
  }, [sendErr, sendData]);

  useEffect(() => {
    if (verifyErr?.data?.message) toast.error(verifyErr.data.message);
    if (verifyData?.success || verifyData?.token || verifyData?.user) {
      // Backend used sendToken -> refresh auth then go home
      dispatch(userApi.endpoints.getMe.initiate(null))
        .unwrap()
        .catch(() => {})
        .finally(() => {
          toast.success("Verified & logged in!");
          navigate("/");
        });
    }
  }, [verifyErr, verifyData, dispatch, navigate]);

  // UPPERCASE & 6-char limit
  const onCodeChange = (v) => {
    const cleaned = v.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 6);
    setCode(cleaned);
  };

  const resendLabel =
    cooldownLeft > 0 ? `Resend code (${cooldownLeft}s)` : (sending ? "Sending…" : "Resend code");

  return (
    <>
      <MetaData title="Verify Email Code" />
      <div className="row wrapper">
        <div className="col-10 col-lg-5">
          <form className="shadow rounded bg-body p-4" onSubmit={submitVerify}>
            <h2 className="mb-3">Enter Verification Code</h2>

            <div className="mb-3">
              <label htmlFor="email_field" className="form-label">Email</label>
              <input
                type="email"
                id="email_field"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="mb-3">
              <label htmlFor="code_field" className="form-label">6-character code (A–Z, 0–9)</label>
              <input
                type="text"
                id="code_field"
                className="form-control"
                placeholder="E.g. A7B9KD"
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                autoComplete="one-time-code"
              />
              <div className="form-text">Expires in ~30 minutes.</div>
            </div>

            <button type="submit" className="btn btn-primary w-100" disabled={verifying}>
              {verifying ? "Verifying..." : "Verify & Continue"}
            </button>

            <button
              type="button"
              className="btn btn-link w-100 mt-2"
              onClick={resend}
              disabled={sending || cooldownLeft > 0}
              aria-disabled={sending || cooldownLeft > 0}
              title={cooldownLeft > 0 ? `Please wait ${cooldownLeft}s` : "Send a new code"}
            >
              {resendLabel}
            </button>

            <p className="mt-3 mb-0 text-center">
              Already verified? <Link to="/">Go Home</Link>
            </p>
          </form>
        </div>
      </div>
    </>
  );
};

export default VerifyEmailCode;
