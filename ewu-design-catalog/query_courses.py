#!/usr/bin/env python3
"""
Utility script for querying EWU Design course relationships.
Usage examples:
  python query_courses.py --prerequisites DESN-368
  python query_courses.py --unlocks DESN-216
  python query_courses.py --track web-development
  python query_courses.py --level 300
"""

import os
import re
import argparse
from pathlib import Path

def parse_frontmatter(content):
    """Extract frontmatter from markdown file"""
    if not content.startswith('---'):
        return {}
    
    parts = content.split('---', 2)
    if len(parts) < 3:
        return {}
    
    frontmatter = {}
    lines = parts[1].strip().split('\n')
    
    current_key = None
    current_list = []
    
    for line in lines:
        if ':' in line and not line.startswith(' '):
            if current_key and current_list:
                frontmatter[current_key] = current_list
                current_list = []
            
            key, value = line.split(':', 1)
            key = key.strip()
            value = value.strip()
            
            if value:
                if value.startswith('[') and value.endswith(']'):
                    # Parse list
                    frontmatter[key] = eval(value)
                else:
                    frontmatter[key] = value
            current_key = key
        elif line.startswith('  -') and current_key:
            current_list.append(line.strip('- ').strip())
    
    if current_key and current_list:
        frontmatter[current_key] = current_list
    
    return frontmatter

def load_all_courses(base_path='courses'):
    """Load all course files and their metadata"""
    courses = []
    
    for level_dir in Path(base_path).glob('*-level'):
        for course_file in level_dir.glob('*.md'):
            with open(course_file, 'r') as f:
                content = f.read()
                metadata = parse_frontmatter(content)
                if metadata:
                    metadata['filepath'] = str(course_file)
                    courses.append(metadata)
    
    return courses

def find_prerequisites(course_code, courses):
    """Find what prerequisites a course requires"""
    for course in courses:
        if course.get('course_code') == course_code:
            prereqs = course.get('prerequisites', [])
            if isinstance(prereqs, list):
                return prereqs
            elif prereqs:
                return [prereqs]
    return []

def find_unlocks(course_code, courses):
    """Find what courses this course unlocks"""
    unlocked = []
    for course in courses:
        prereqs = course.get('prerequisites', [])
        if isinstance(prereqs, str):
            if course_code in prereqs:
                unlocked.append(course.get('course_code'))
        elif isinstance(prereqs, list):
            if course_code in prereqs:
                unlocked.append(course.get('course_code'))
    return unlocked

def find_by_track(track, courses):
    """Find all courses in a track"""
    return [c for c in courses if c.get('track') == track]

def find_by_level(level, courses):
    """Find all courses at a level"""
    return [c for c in courses if c.get('level') == int(level)]

def find_sequence(course_code, courses, direction='forward'):
    """Find course sequence (what comes before or after)"""
    if direction == 'forward':
        # Find what this course unlocks, recursively
        sequence = [course_code]
        unlocked = find_unlocks(course_code, courses)
        for next_course in unlocked:
            sequence.extend(find_sequence(next_course, courses, 'forward'))
        return sequence
    else:
        # Find what prerequisites this needs, recursively
        sequence = [course_code]
        prereqs = find_prerequisites(course_code, courses)
        for prereq in prereqs:
            if 'DESN' in prereq:  # Only DESN courses
                sequence.extend(find_sequence(prereq, courses, 'backward'))
        return sequence

def main():
    parser = argparse.ArgumentParser(description='Query EWU Design course catalog')
    parser.add_argument('--prerequisites', help='Show prerequisites for a course')
    parser.add_argument('--unlocks', help='Show what courses this unlocks')
    parser.add_argument('--track', help='Show all courses in a track')
    parser.add_argument('--level', help='Show all courses at a level')
    parser.add_argument('--sequence-forward', help='Show forward sequence from course')
    parser.add_argument('--sequence-backward', help='Show backward sequence to course')
    parser.add_argument('--list-tracks', action='store_true', help='List all tracks')
    
    args = parser.parse_args()
    
    # Load all courses
    courses = load_all_courses()
    print(f"Loaded {len(courses)} courses\n")
    
    if args.prerequisites:
        prereqs = find_prerequisites(args.prerequisites, courses)
        print(f"Prerequisites for {args.prerequisites}:")
        if prereqs:
            for p in prereqs:
                print(f"  - {p}")
        else:
            print("  None")
    
    elif args.unlocks:
        unlocked = find_unlocks(args.unlocks, courses)
        print(f"{args.unlocks} unlocks:")
        if unlocked:
            for u in sorted(unlocked):
                print(f"  - {u}")
        else:
            print("  No direct dependents")
    
    elif args.track:
        track_courses = find_by_track(args.track, courses)
        print(f"Courses in '{args.track}' track:")
        for c in sorted(track_courses, key=lambda x: x.get('course_code', '')):
            print(f"  {c.get('course_code')} - {c.get('course_name')} ({c.get('credits')} cr)")
    
    elif args.level:
        level_courses = find_by_level(args.level, courses)
        print(f"{args.level}-level courses:")
        for c in sorted(level_courses, key=lambda x: x.get('course_code', '')):
            print(f"  {c.get('course_code')} - {c.get('course_name')}")
    
    elif args.sequence_forward:
        sequence = find_sequence(args.sequence_forward, courses, 'forward')
        print(f"Forward sequence from {args.sequence_forward}:")
        for i, course in enumerate(sequence):
            indent = "  " * i
            print(f"{indent}→ {course}")
    
    elif args.sequence_backward:
        sequence = find_sequence(args.sequence_backward, courses, 'backward')
        print(f"Path to {args.sequence_backward}:")
        for i, course in enumerate(reversed(sequence)):
            indent = "  " * i
            print(f"{indent}→ {course}")
    
    elif args.list_tracks:
        tracks = set(c.get('track') for c in courses if c.get('track'))
        print("Available tracks:")
        for track in sorted(tracks):
            count = len(find_by_track(track, courses))
            print(f"  - {track} ({count} courses)")

if __name__ == '__main__':
    main()
