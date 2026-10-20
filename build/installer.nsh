!macro customInstall
  WriteRegStr HKCU "Software\Classes\*\shell\DIAL" "MUIVerb" "Analizar con DIAL"
  WriteRegStr HKCU "Software\Classes\*\shell\DIAL" "Icon" "$INSTDIR\DIAL.exe"
  WriteRegStr HKCU "Software\Classes\*\shell\DIAL" "MultiSelectModel" "Player"
  WriteRegStr HKCU "Software\Classes\*\shell\DIAL\command" "" '"$INSTDIR\DIAL.exe" "%1"'

  WriteRegStr HKCU "Software\Classes\Directory\shell\DIAL" "MUIVerb" "Analizar carpeta con DIAL"
  WriteRegStr HKCU "Software\Classes\Directory\shell\DIAL" "Icon" "$INSTDIR\DIAL.exe"
  WriteRegStr HKCU "Software\Classes\Directory\shell\DIAL\command" "" '"$INSTDIR\DIAL.exe" "%1"'

  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\DIAL" "MUIVerb" "Analizar esta carpeta con DIAL"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\DIAL" "Icon" "$INSTDIR\DIAL.exe"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\DIAL\command" "" '"$INSTDIR\DIAL.exe" "%V"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\*\shell\DIAL"
  DeleteRegKey HKCU "Software\Classes\Directory\shell\DIAL"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\DIAL"
!macroend

!macro customFinishPage
  !define MUI_FINISHPAGE_LINK "Hecho por Esteban Nicola · estebanico.com"
  !define MUI_FINISHPAGE_LINK_LOCATION "https://estebanico.com"
  !ifndef HIDE_RUN_AFTER_FINISH
    Function StartApp
      ${if} ${isUpdated}
        StrCpy $1 "--updated"
      ${else}
        StrCpy $1 ""
      ${endif}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_TEXT "Ejecutar DIAL"
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !endif
  !insertmacro MUI_PAGE_FINISH
!macroend
