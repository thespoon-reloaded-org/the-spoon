#!/usr/bin/env bash
# Installe Homebrew dans une fenêtre Terminal, là où le participant peut
# taper le mot de passe du Mac. Claude Code l'ouvre avec :
#   open -a Terminal scripts/installer-homebrew.sh
# puis attend que `brew` apparaisse avant de relancer installer-poste.sh.
set -euo pipefail

trouver_brew() {
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && { echo "$b"; return 0; }; done
  return 1
}

clear
printf '\033[1mInstallation de Homebrew pour TheSpoon\033[0m\n\n'
if BREW=$(trouver_brew); then
  printf 'Homebrew est déjà là (%s).\n' "$BREW"
else
  printf 'Homebrew va vous demander le mot de passe de votre Mac (rien ne s’affiche quand vous tapez, c’est normal),\n'
  printf 'puis d’appuyer sur Entrée. Comptez 5 à 10 minutes.\n\n'
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  BREW=$(trouver_brew) || { printf '\n\033[31m✗ Homebrew ne s’est pas installé. Copiez le message ci-dessus dans Claude Code.\033[0m\n'; exit 1; }
fi

# Rend `brew` disponible dans les prochains terminaux.
grep -qF 'brew shellenv' "$HOME/.zprofile" 2>/dev/null || \
  echo "eval \"\$($BREW shellenv)\" # Homebrew" >> "$HOME/.zprofile"

printf '\n\033[32m✓ Homebrew prêt.\033[0m Vous pouvez fermer cette fenêtre et revenir dans Claude Code.\n'
