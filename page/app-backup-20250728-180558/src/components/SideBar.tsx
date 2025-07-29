import React from "react";
import { Link } from "react-router-dom";
import { Divider, Menu } from "react-daisyui";
import { FaBook, FaTerminal, FaCode, FaCogs, FaUtensils } from "react-icons/fa";

export const SideBar = () => {
  return (
    <Menu className="p-4 overflow-y-auto w-80 h-full bg-base-100 text-base-content bg-base-200">
      <figure className="flex justify-center max-w-xs mb-5">
        <Link to="/">
          <img
            className="w-20"
            src="https://user-images.githubusercontent.com/1074042/229266531-5060f1a7-b270-481c-8bac-db74b46214ee.svg"
            alt="Codependence Logo"
          />
        </Link>
      </figure>
      <h2 className="font-title font-black text-primary inline-flex text-lg transition-all duration-200 md:text-3xl mb-5">
        <Link to="/">Codependence</Link>
      </h2>
      <h3 className="font-title text-base-content inline-flex text-sm transition-all duration-200 md:text-3m pl-4">
        Codependence is a JavaScript utility for checking dependencies to ensure
        they're up-to-date or match a specified version.
      </h3>
      <Divider />
      <div className="collapse collapse-arrow border border-base-300 bg-base-100 rounded-box">
        <input type="checkbox" defaultChecked={true} />
        <div className="collapse-title font-bold">
          Do you want a dead simple way to maintain npm dependencies?
        </div>
        <div className="collapse-content">
          <ul className="menu menu-compact">
            <li>
              <a href="#main-usecase">Main Usecase</a>
            </li>
            <li>
              <a href="#synopsis">Synopsis</a>
            </li>
            <li>
              <a href="#why-use-codependence">Why use Codependence?</a>
            </li>
            <li>
              <a href="#why-not-use-codependence">Why not use Codependence?</a>
            </li>
          </ul>
        </div>
      </div>
      <Divider />
      <ul className="menu menu-compact">
        <li>
          <Link to="/usage/">
            <FaBook /> Basic Usage
          </Link>
        </li>
        <li>
          <Link to="/cli/">
            <FaTerminal /> CLI
          </Link>
        </li>
        <li>
          <Link to="/node/">
            <FaCode /> Node
          </Link>
        </li>
        <li>
          <Link to="/options/">
            <FaCogs /> Options
          </Link>
        </li>
        <li>
          <Link to="/recipes/">
            <FaUtensils /> Recipes
          </Link>
        </li>
      </ul>
    </Menu>
  );
};
