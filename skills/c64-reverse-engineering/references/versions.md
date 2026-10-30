# Project layout and versions

The project layout, and the group folder for versions of one program. The section "The stages of a full rebuild" of `<skill>/SKILL.md` refers to them.

## Project layout

If the project has no layout, use this one. No script checks it. Each script takes the paths that you give.

```
releases/      the disk image or the program as you got it
src/           the generated source
build/         the built programs. Do not commit them: each build writes them again.
tests/         the test scenarios, and the recordings in tests/recordings/
runs/          the runs that the knowledge gives as evidence
docs/          the documentation, with the reference in docs/reference/
tools/         scripts for the formats of this program only
README.md      the entry page of the documentation
```

Commit each folder of the layout other than `build/`, and `.c64-re-tools/knowledge/`. The project knowledge holds the program, the entry state, the bytes of each release and the coverage. Thus the project needs no other folder for them. Put all other files that you make in `.c64-re-tools/local/`, also the captures and the coverage maps after you put them into the knowledge. Do not let git ignore a folder of the layout other than `build/`. Do not change the `.gitignore` files of the project.

If the project has a layout, use that layout.

A workspace with several projects keeps its routine library in `library/` beside the projects. The library is not a project folder.

## Versions of one program

Some releases of a program have a different layout. Their code is at different addresses, so patches cannot hold the differences. Each of these releases is a version of the program. Give each version a project of its own in a group folder:

```
<game>/          the group folder: not a project
  README.md      the shared entry page: the program, each version, and how the versions differ
  docs/          the shared pages: the development, the changes between the versions, the releases, the disk layout
  library/       the routine library of the versions
  tools/         the scripts for the formats of the program, for all versions
  v1/            the project of the first version, with the project layout
  v2/            the project of the second version, with the project layout
```

1. Make the group folder in the git repository. Do not put `.c64-re-tools/` in it.
2. Ask the user before you move a project folder. Then move the current project into `<game>/v1/`. The project knowledge stays valid after the move.
3. Make a project folder for the new version, for example `<game>/v2/`. Start at stage 2 with the file of that release. From the group folder, give `--project v2`. In the empty folder `v2/`, give `--project .`. The first write makes the project.
4. Keep the releases with the same layout in one version. Record them as releases with switches. For example, `v2` holds a base release and a second release from a different crack.
5. Save the routines of `v1` to the routine library in `<game>/library/`. Give `--library ../library`, because `--library` is relative to the project folder. In stage 7 of `v2`, match the program against that library. Then `v2` gets the names of `v1` for the same routines.
6. Use the same folders in each version, for example `src` and `docs/reference`.
7. From the group folder, give `--project v1` or `--project v2` to each script. A script can read a file of another version, for example `../v1/releases/<file>`. Use this to compare the releases of two versions. Record each release only in the project of its version.
8. Write the facts that the versions share one time, in the pages of the group folder. The pages of each version tell only how that version works.
