self:
{
  config,
  lib,
  pkgs,
  ...
}:
let
  cfg = config.services.kinoko;
  inherit (lib)
    mkEnableOption
    mkIf
    mkOption
    types
    ;
in
{
  options.services.kinoko = {
    enable = mkEnableOption "the Kinoko service (API and data pipeline)";

    package = mkOption {
      type = types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.backend;
      description = "The package with the kinoko binary.";
    };

    frontend = mkOption {
      type = types.package;
      default = self.packages.${pkgs.stdenv.hostPlatform.system}.frontend;
      description = "The built Angular app. A web server serves it; this module does not.";
    };

    listen = mkOption {
      type = types.str;
      default = "127.0.0.1:8111";
      description = "Address and port of the API.";
    };

    stateDir = mkOption {
      type = types.str;
      default = "/var/lib/pilze-app";
      description = "Folder for the database, the photos and the pipeline data.";
    };

    mapsDir = mkOption {
      type = types.str;
      default = "/var/www/pilze";
      description = "Folder where the pipeline writes manifests and tiles. The web server serves it.";
    };

    origin = mkOption {
      type = types.str;
      example = "https://pilze.beimgraben.net";
      description = "Public origin of the app, for CORS and links.";
    };

    oidc = {
      issuer = mkOption {
        type = types.str;
        example = "https://sso.beimgraben.net/application/o/pilze/";
        description = "OpenID issuer. Discovery and keys follow from it.";
      };
      clientId = mkOption {
        type = types.str;
        default = "pilze";
        description = "Expected audience of the access tokens.";
      };
      adminGroup = mkOption {
        type = types.str;
        default = "pilze-admins";
        description = "A person in this group has each permission.";
      };
    };

    pipeline = {
      enable = mkOption {
        type = types.bool;
        default = true;
        description = "Run the data pipeline in the service.";
      };
      schedule = mkOption {
        type = types.str;
        default = "Mon 03:30 Europe/Berlin";
        description = "When the weekly fetch and render run starts.";
      };
    };

    memoryMax = mkOption {
      type = types.str;
      default = "6G";
      description = "Memory limit of the service. Training and rendering need more than the API.";
    };

    environment = mkOption {
      type = types.attrsOf types.str;
      default = { };
      description = "More PILZE_* variables.";
    };
  };

  config = mkIf cfg.enable {
    users.users.pilzeapp = {
      isSystemUser = true;
      group = "pilzeapp";
      home = cfg.stateDir;
    };
    users.groups.pilzeapp = { };

    systemd.tmpfiles.rules = [
      "d ${cfg.stateDir} 0750 pilzeapp pilzeapp -"
      "d ${cfg.mapsDir} 0755 pilzeapp pilzeapp -"
    ];

    systemd.services.kinoko = {
      description = "Kinoko API and data pipeline";
      wantedBy = [ "multi-user.target" ];
      after = [ "network-online.target" ];
      wants = [ "network-online.target" ];
      environment = {
        PILZE_DB = "${cfg.stateDir}/pilze.sqlite";
        PILZE_FOTOS = "${cfg.stateDir}/fotos";
        PILZE_DATA = "${cfg.stateDir}/daten";
        PILZE_RUN_LOGS = "${cfg.stateDir}/runs";
        PILZE_MAPS = cfg.mapsDir;
        PILZE_LISTEN = cfg.listen;
        PILZE_ORIGIN = cfg.origin;
        PILZE_OIDC_ISSUER = cfg.oidc.issuer;
        PILZE_OIDC_CLIENT_ID = cfg.oidc.clientId;
        PILZE_ADMIN_GROUP = cfg.oidc.adminGroup;
        PILZE_PIPELINE = lib.boolToString cfg.pipeline.enable;
        PILZE_SCHEDULE = cfg.pipeline.schedule;
        PROJ_DATA = "${pkgs.proj}/share/proj";
        GDAL_DATA = "${pkgs.gdal}/share/gdal";
      }
      // cfg.environment;
      serviceConfig = {
        ExecStart = "${lib.getExe cfg.package} serve";
        User = "pilzeapp";
        Group = "pilzeapp";
        WorkingDirectory = cfg.stateDir;
        Restart = "on-failure";
        RestartSec = 5;
        MemoryMax = cfg.memoryMax;
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
        NoNewPrivileges = true;
        ReadWritePaths = [
          cfg.stateDir
          cfg.mapsDir
        ];
      };
    };
  };
}
