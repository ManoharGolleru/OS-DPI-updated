mkdir src

for /d %%i in (*) do (
    if not "%%i" == ".git" if not "%%i" == ".github" if not "%%i" == "Designs In Progress" if not "%%i" == "Tango Documents" if not "%%i" == "Testing" if not "%%i" == "examples" (
        move "%%i" src
    )
)

for %%i in (*) do (
    if not "%%i" == ".git" if not "%%i" == ".github" if not "%%i" == "Designs In Progress" if not "%%i" == "Tango Documents" if not "%%i" == "Testing" if not "%%i" == "examples" if not "%%i" == ".gitignore" if not "%%i" == "README.md" (
        move "%%i" src
    )
)
