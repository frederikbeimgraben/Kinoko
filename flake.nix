{
  description = "Kinoko: mushroom forecast map for Germany (Go service with data pipeline, Angular app)";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAll = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});

      # The C libraries of the data pipeline. LightGBM trains and applies the
      # models, netCDF reads the DWD grids, GDAL and PROJ warp the rasters.
      nativeLibraries =
        pkgs: with pkgs; [
          lightgbm
          netcdf
          gdal
          proj
        ];
    in
    {
      packages = forAll (
        pkgs:
        let
          version = "3.0.0";
        in
        {
          backend = pkgs.buildGoModule {
            pname = "kinoko";
            inherit version;
            src = ./backend;
            vendorHash = "sha256-onDA6qj0kLhZfbXUtNJJtlUQinqRlJ8q7wIh1yL3z5c=";
            proxyVendor = true;
            # CI runs the tests in the dev shell. The package build only compiles.
            doCheck = false;
            subPackages = [ "cmd/kinoko" ];
            env.CGO_ENABLED = "1";
            nativeBuildInputs = [ pkgs.pkg-config ];
            buildInputs = nativeLibraries pkgs;
            ldflags = [
              "-s"
              "-w"
            ];
            # The tests need a writable home for the Go build cache only.
            preCheck = ''
              export HOME=$TMPDIR
            '';
            meta.mainProgram = "kinoko";
          };

          frontend = pkgs.buildNpmPackage {
            pname = "kinoko-frontend";
            inherit version;
            src = ./frontend;
            nodejs = pkgs.nodejs_24;
            npmDepsHash = pkgs.lib.fakeHash;
            env.KINOKO_VERSION = version;
            installPhase = ''
              runHook preInstall
              cp -r dist/pilzkarte/browser $out
              runHook postInstall
            '';
          };

          default = self.packages.${pkgs.stdenv.hostPlatform.system}.backend;
        }
      );

      devShells = forAll (
        pkgs:
        let
          backendTools = with pkgs; [
            go
            gopls
            gotools
            golangci-lint
            gcc
            pkg-config
            sqlite
            git
          ];
          frontendTools = with pkgs; [
            nodejs_24
            git
          ];
          # Playwright on NixOS uses the Chromium of nixpkgs.
          browser = {
            BROWSER_PATH = "${pkgs.chromium}/bin/chromium";
            CHROME_PATH = "${pkgs.chromium}/bin/chromium";
            PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1";
          };
        in
        {
          backend = pkgs.mkShell {
            packages = backendTools ++ nativeLibraries pkgs;
            CGO_ENABLED = "1";
          };

          frontend = pkgs.mkShell (browser // { packages = frontendTools; });

          default = pkgs.mkShell (
            browser
            // {
              packages = backendTools ++ frontendTools ++ nativeLibraries pkgs;
              CGO_ENABLED = "1";
            }
          );
        }
      );

      nixosModules.default = import ./deploy/module.nix self;

      checks = forAll (pkgs: {
        backend = self.packages.${pkgs.stdenv.hostPlatform.system}.backend;
      });

      formatter = forAll (pkgs: pkgs.nixfmt-rfc-style);
    };
}
