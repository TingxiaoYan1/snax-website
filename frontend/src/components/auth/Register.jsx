import React, { useEffect, useState } from "react";
import { useRegisterMutation } from "../../redux/api/authApi";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import MetaData from "../layout/MetaData";

const Register = () => {
  const [user, setUser] = useState({ name: "", email: "", password: "" });
  const { name, email, password } = user;

  const navigate = useNavigate();
  const [register, { isLoading, error, data }] = useRegisterMutation();
  const { isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated) navigate("/");
    if (error) toast.error(error?.data?.message || "Registration failed");
  }, [error, isAuthenticated]);

  useEffect(() => {
    if (data?.success) {
      toast.success(data?.message || "Account created. Verification code sent.");
      // go to code entry page with email in query
      navigate(`/verify-email-code?email=${encodeURIComponent(email)}`);
    }
  }, [data]);

  const submitHandler = (e) => {
    e.preventDefault();
    register({ name, email, password });
  };

  const onChange = (e) => setUser({ ...user, [e.target.name]: e.target.value });

  return (
    <>
      <MetaData title="Register" />
      <div className="row wrapper">
        <div className="col-10 col-lg-5">
          <form className="shadow rounded bg-body p-4" onSubmit={submitHandler}>
            <h2 className="mb-4">Register</h2>

            <div className="mb-3">
              <label htmlFor="name_field" className="form-label">Name</label>
              <input type="text" id="name_field" className="form-control" name="name"
                value={name} onChange={onChange} autoComplete="name" />
            </div>

            <div className="mb-3">
              <label htmlFor="email_field" className="form-label">Email</label>
              <input type="email" id="email_field" className="form-control" name="email"
                value={email} onChange={onChange} autoComplete="email" />
            </div>

            <div className="mb-3">
              <label htmlFor="password_field" className="form-label">Password</label>
              <input type="password" id="password_field" className="form-control" name="password"
                value={password} onChange={onChange} autoComplete="new-password" />
            </div>

            <button id="register_button" type="submit" className="btn btn-primary w-100 py-2" disabled={isLoading}>
              {isLoading ? "Creating..." : "REGISTER"}
            </button>

            <p className="mt-3 mb-0 text-center">
              Already have an account? <Link to="/login">Login</Link>
            </p>
          </form>
        </div>
      </div>
    </>
  );
};

export default Register;