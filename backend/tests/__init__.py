"""Marks the backend tests as a package.

Without this file `python -m unittest discover` refuses the directory outright ("Start directory
is not importable"), so the suite could only be run by naming all three modules by hand. Tests that
require an incantation to find are tests that quietly stop being run.
"""
